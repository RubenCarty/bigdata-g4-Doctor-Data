package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID       uuid.UUID `json:"user_id"`
	IsDoctor     bool      `json:"is_doctor"`
	IsAdmin      bool      `json:"is_admin"`
	IsSuperAdmin bool      `json:"is_super_admin"`
	IsAccounting bool      `json:"is_accounting"`
	IsSales      bool      `json:"is_sales"`
	jwt.RegisteredClaims
}

// JWTAuth valida el token Bearer en cada petición autenticada.
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("is_doctor", claims.IsDoctor)
		c.Set("is_admin", claims.IsAdmin)
		c.Set("is_super_admin", claims.IsSuperAdmin)
		c.Set("is_accounting", claims.IsAccounting)
		c.Set("is_sales", claims.IsSales)
		c.Next()
	}
}

// OptionalUserID intenta leer el user_id de un Bearer token si viene presente y es válido,
// sin exigirlo ni abortar la request — para rutas públicas que, cuando hay sesión, quieren
// enriquecer la respuesta con algo específico del usuario (ver
// BillingPublicHandler.PreviewDiscount, que así puede avisar "ya usaste este código" incluso
// antes de que el usuario intente el checkout autenticado).
func OptionalUserID(c *gin.Context) (uuid.UUID, bool) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return uuid.Nil, false
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, false
	}
	return claims.UserID, true
}

// RequireDoctor permite acceso solo a médicos o admins.
func RequireDoctor() gin.HandlerFunc {
	return func(c *gin.Context) {
		isDoctor, _ := c.Get("is_doctor")
		isAdmin, _ := c.Get("is_admin")
		if !isDoctor.(bool) && !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "medical credentials required"})
			return
		}
		c.Next()
	}
}

// RequireAdmin permite acceso solo a administradores del sistema.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, _ := c.Get("is_admin")
		if !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

// RequireSuperAdmin permite acceso solo a superadministradores del sistema.
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSuperAdmin, _ := c.Get("is_super_admin")
		if !isSuperAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "super admin access required"})
			return
		}
		c.Next()
	}
}

// RequireAccounting permite acceso a Contabilidad (is_accounting) o a cualquier admin — un
// admin no queda excluido de nada, esto solo abre el acceso a una cuenta más angosta que no
// necesita (ni debe ver) el resto de /admin/*. Usado solo para boletas/facturas/sales-stats,
// ver internal/server/routes.go.
func RequireAccounting() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAccounting, _ := c.Get("is_accounting")
		isAdmin, _ := c.Get("is_admin")
		if !isAccounting.(bool) && !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accounting access required"})
			return
		}
		c.Next()
	}
}

// RequireStaff permite acceso a cualquiera de los roles que la empresa le paga por su
// trabajo — Ventas, Contabilidad o admin (is_super_admin siempre implica is_admin=true, así
// que no hace falta chequearlo aparte) — usado solo para /me/bank-account, donde cada quien
// carga los datos de la cuenta a la que se le debe pagar.
func RequireStaff() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSales, _ := c.Get("is_sales")
		isAccounting, _ := c.Get("is_accounting")
		isAdmin, _ := c.Get("is_admin")
		if !isSales.(bool) && !isAccounting.(bool) && !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "staff access required"})
			return
		}
		c.Next()
	}
}

// RequireSales permite acceso a Ventas (is_sales) o a cualquier admin — mismo criterio que
// RequireAccounting: un admin no queda excluido de nada, esto solo abre el acceso a una
// cuenta más angosta. Usado solo para /admin/sellers/*, ver internal/server/routes.go.
func RequireSales() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSales, _ := c.Get("is_sales")
		isAdmin, _ := c.Get("is_admin")
		if !isSales.(bool) && !isAdmin.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "sales access required"})
			return
		}
		c.Next()
	}
}
