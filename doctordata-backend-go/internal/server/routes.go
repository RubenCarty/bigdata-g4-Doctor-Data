package server

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"doctordata-backend-go/internal/handlers"
	"doctordata-backend-go/internal/middleware"
	"doctordata-backend-go/internal/payments"
)

// corsAllowedOrigins lee CORS_ALLOWED_ORIGINS (lista separada por comas) para permitir el
// dominio real en producción sin tocar código; sin esa variable, cae a los orígenes de
// desarrollo local de siempre.
func corsAllowedOrigins() []string {
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw == "" {
		return []string{"http://localhost:3000", "http://localhost:5173"}
	}
	origins := make([]string, 0)
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

func (s *Server) RegisterRoutes() http.Handler {
	// DEBUG=true (QA) deja el modo debug de Gin: imprime el listado de rutas al
	// arrancar y logs más verbosos. Por defecto (y siempre en producción) va en
	// ReleaseMode — no expone el mapa completo de rutas en los logs del contenedor.
	if os.Getenv("DEBUG") != "true" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     corsAllowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// ── Health check ────────────────────────────────────────────────────────
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"service": "doctordata-api", "version": "1.0.1.3"})
	})

	// Uploads estáticos (fotos de perfil y carnés CMP)
	r.Static("/uploads", "./uploads")

	// ── Handlers ─────────────────────────────────────────────────────────────
	authH := handlers.NewAuthHandler(s.db)
	medH := handlers.NewMedicalHandler(s.db)
	admMedH := handlers.NewAdminMedicalHandler(s.db)
	admUsrH := handlers.NewAdminUsersHandler(s.db)
	patH := handlers.NewPatientHandler(s.db)
	clinH := handlers.NewClinicalHandler(s.db)
	pubH := handlers.NewPublicHandler(s.db)

	gateway := payments.NewGatewayFromEnv(s.db)
	billingPubH := handlers.NewBillingPublicHandler(s.db)
	billingH := handlers.NewBillingHandler(s.db, gateway)
	billingWebhookH := handlers.NewBillingWebhookHandler(s.db, gateway)
	memberH := handlers.NewMemberHandler(s.db)
	admBillingH := handlers.NewAdminBillingHandler(s.db)
	adminAuditH := handlers.NewAdminAuditHandler(s.db)
	partnershipH := handlers.NewPartnershipHandler(s.db)
	adminSalesH := handlers.NewAdminSalesHandler(s.db)
	sellerH := handlers.NewSellerHandler(s.db)
	bankH := handlers.NewBankAccountHandler(s.db)

	// ── Rutas públicas sin autenticación ─────────────────────────────────────
	// GET /public/patient/:userId — perfil básico + alergias para QR/emergencia
	r.GET("/public/patient/:userId", pubH.PatientPublicProfile)
	r.GET("/public/patient-profile/:profileId", pubH.PatientPublicProfileByID)
	r.GET("/public/plans", billingPubH.ListActivePlans)
	r.POST("/public/discount-codes/preview", billingPubH.PreviewDiscount)
	r.GET("/public/stats", pubH.GetStats)
	r.POST("/public/partnership-requests", partnershipH.Create)

	// ── Webhooks de pago — sin JWT, autenticados por firma dentro del handler ────────────
	r.POST("/billing/webhook/izipay", billingWebhookH.HandleIzipayWebhook)
	if os.Getenv("PAYMENT_GATEWAY") != "izipay" {
		r.POST("/billing/webhook/stub-confirm", billingWebhookH.HandleStubConfirm)
	}

	// Nota: el flujo real de Izipay (Embedded/Krypton) no necesita redirección ni retorno
	// server-rendered — el frontend arma el formulario embebido con el formToken que ya
	// devuelve POST /me/subscriptions/checkout, y confirma con KR.onSubmit en el navegador.
	// La IPN de arriba (POST /billing/webhook/izipay) sigue siendo la fuente de verdad real.

	// ── Auth (público) ───────────────────────────────────────────────────────
	auth := r.Group("/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		auth.POST("/verify-code", authH.VerifyCode)
		auth.POST("/resend-code", authH.ResendCode)
		auth.POST("/forgot-password", authH.ForgotPassword)
		auth.POST("/reset-password", authH.ResetPassword)
	}

	// ── Rutas autenticadas ───────────────────────────────────────────────────
	api := r.Group("/")
	api.Use(middleware.JWTAuth())
	{
		// Perfil propio
		api.GET("/auth/me", authH.Me)

		// Módulo médico
		medical := api.Group("/medical")
		{
			medical.POST("/activate", medH.Activate)
			medical.GET("/profile", medH.GetProfile)
			medical.PUT("/profile", medH.UpdateProfile)
		}

		// Suscripciones / checkout propio — NO requiere una suscripción activa (sería
		// circular: es justo el flujo para conseguir una).
		billing := api.Group("/me/subscriptions")
		{
			billing.GET("", billingH.ListMySubscriptions)
			billing.GET("/capacity", billingH.GetMyCapacity)
			billing.POST("/checkout", billingH.CreateCheckout)
			billing.GET("/:id", billingH.GetSubscriptionStatus)
		}

		// Perfil de paciente propio y personas cubiertas ("básica") — la lectura queda
		// siempre disponible aunque la suscripción venza, para nunca perder datos ya
		// cargados; la escritura sigue requiriendo suscripción activa.
		meBasic := api.Group("/me")
		{
			meBasic.GET("/patient", patH.GetMyProfile)
			meBasic.PUT("/patient", middleware.RequireActiveSubscription(s.db), patH.UpdateMyProfile)
			meBasic.PUT("/patient/life-status", middleware.RequireActiveSubscription(s.db), patH.UpdateMyLifeStatus)
			meBasic.POST("/patient/upload/photo", middleware.RequireActiveSubscription(s.db), patH.UploadProfilePhoto)
			meBasic.GET("/qr", patH.GetMyQR)

			// Personas cubiertas por la suscripción del titular
			meBasic.GET("/members", memberH.ListMyMembers)
			meBasic.POST("/members", middleware.RequireActiveSubscription(s.db), memberH.AddMember)
			meBasic.PUT("/members/:id", middleware.RequireActiveSubscription(s.db), memberH.UpdateMember)
			meBasic.PUT("/members/:id/life-status", middleware.RequireActiveSubscription(s.db), memberH.UpdateMemberLifeStatus)
			meBasic.POST("/members/:id/upload/photo", middleware.RequireActiveSubscription(s.db), memberH.UploadMemberPhoto)
			meBasic.DELETE("/members/:id", middleware.RequireActiveSubscription(s.db), memberH.RemoveMember)
			meBasic.POST("/members/:id/nominate-doctor", middleware.RequireActiveSubscription(s.db), memberH.NominateDoctor)
		}

		// Actividad médica ("médica") — lectura Y escritura requieren suscripción activa;
		// al vencer, esta información se oculta por completo (a diferencia de la básica).
		meMedical := api.Group("/me")
		meMedical.Use(middleware.RequireActiveSubscription(s.db))
		{
			// Alergias — accesibles para el propio usuario
			meMedical.GET("/allergies", clinH.ListAllergies)
			meMedical.POST("/allergies", clinH.CreateAllergy)
			meMedical.PUT("/allergies/:id", clinH.UpdateAllergy)
			meMedical.DELETE("/allergies/:id", clinH.DeleteAllergy)

			// Condiciones
			meMedical.GET("/conditions", clinH.ListConditions)
			meMedical.POST("/conditions", clinH.CreateCondition)
			meMedical.PUT("/conditions/:id", clinH.UpdateCondition)
			meMedical.DELETE("/conditions/:id", clinH.DeleteCondition)

			// Antecedentes familiares — mismo criterio que condiciones: el titular/persona
			// cubierta lo escribe, pero solo se muestra a doctores (ver grupo /patients).
			meMedical.GET("/family-history", clinH.ListFamilyHistory)
			meMedical.POST("/family-history", clinH.CreateFamilyHistory)
			meMedical.PUT("/family-history/:id", clinH.UpdateFamilyHistory)
			meMedical.DELETE("/family-history/:id", clinH.DeleteFamilyHistory)

			// Citas
			meMedical.GET("/appointments", clinH.ListAppointments)
			meMedical.POST("/appointments", clinH.CreateAppointment)
			meMedical.PUT("/appointments/:id", clinH.UpdateAppointment)

			// Descansos médicos — lectura y escritura para el titular (y las personas que
			// cubre); el médico que escanea el QR solo puede leerlos (ver grupo /patients
			// más abajo), nunca escribirlos — son datos del paciente, no del médico.
			meMedical.GET("/medical-leaves", clinH.ListMedicalLeaves)
			meMedical.POST("/medical-leaves", clinH.CreateMedicalLeave)
			meMedical.PUT("/medical-leaves/:id", clinH.UpdateMedicalLeave)

			// Registros clínicos — lectura y escritura para el titular (y las personas que
			// cubre), mismo criterio que descansos médicos: el médico que escanea el QR solo
			// puede leerlos (ver grupo /patients más abajo), nunca escribirlos.
			meMedical.GET("/clinical-records", clinH.ListClinicalRecords)
			meMedical.POST("/clinical-records", clinH.CreateClinicalRecord)
			meMedical.PUT("/clinical-records/:id", clinH.UpdateClinicalRecord)
		}

		// Perfil médico propio (registro de carné CMP + fotos) — a propósito en un grupo
		// separado, SIN RequireActiveSubscription: activar el perfil profesional de un
		// médico no depende de la suscripción de paciente/personas cubiertas.
		medProfile := api.Group("/me")
		{
			medProfile.GET("/medical-profile", medH.GetMyMedicalProfile)
			medProfile.PUT("/medical-profile", medH.UpdateMyMedicalProfile)
			medProfile.POST("/medical-profile/upload/photo", medH.UploadProfilePhoto)
			medProfile.POST("/medical-profile/upload/card", medH.UploadCMPCard)
		}

		// Admin — gestión de médicos, usuarios, planes y descuentos
		admin := api.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/stats", admUsrH.GetStats)

			admin.GET("/users", admUsrH.ListUsers)
			admin.PUT("/users/:id", admUsrH.UpdateUser)
			admin.DELETE("/users/:id", admUsrH.DeleteUser)

			admin.GET("/doctors", admMedH.ListDoctors)
			admin.PUT("/doctors/:id/validate", admMedH.ValidateDoctor)

			admin.GET("/plans", admBillingH.ListPlans)
			admin.POST("/plans", admBillingH.CreatePlan)
			admin.PUT("/plans/:id", admBillingH.UpdatePlan)
			admin.DELETE("/plans/:id", admBillingH.DeletePlan)

			admin.GET("/discount-codes", admBillingH.ListDiscountCodes)
			admin.POST("/discount-codes", admBillingH.CreateDiscountCode)
			admin.PUT("/discount-codes/:id", admBillingH.UpdateDiscountCode)
			admin.DELETE("/discount-codes/:id", admBillingH.DeleteDiscountCode)

			// Audit Log — exclusivo de super admin (RequireAdmin ya corre a nivel de grupo)
			admin.GET("/audit-log", middleware.RequireSuperAdmin(), adminAuditH.ListAuditLog)

			admin.GET("/partnership-requests", partnershipH.List)
			admin.PUT("/partnership-requests/:id", partnershipH.UpdateStatus)
		}

		// Contabilidad — boletas (venta de suscripciones, automáticas) y facturas (convenios,
		// a mano). Grupo APARTE del "admin" de arriba (mismo prefijo /admin, middleware
		// distinto: RequireAccounting deja pasar is_accounting O is_admin) — si quedara
		// anidado dentro del grupo gateado por RequireAdmin(), una cuenta solo-contabilidad
		// nunca pasaría ese primer middleware y jamás llegaría acá.
		accounting := api.Group("/admin")
		accounting.Use(middleware.RequireAccounting())
		{
			accounting.GET("/boletas", adminSalesH.ListBoletas)
			accounting.PUT("/boletas/:id", adminSalesH.UpdateBoleta)
			accounting.GET("/facturas", adminSalesH.ListFacturas)
			accounting.POST("/facturas", adminSalesH.CreateFactura)
			accounting.PUT("/facturas/:id", adminSalesH.UpdateFactura)
			accounting.DELETE("/facturas/:id", adminSalesH.DeleteFactura)
			accounting.GET("/sales-stats", adminSalesH.GetSalesStats)
		}

		// Ventas — leaderboard de comisiones + códigos de descuento propios del vendedor.
		// Prefijo /admin/sellers a propósito distinto de /admin/sales-stats de arriba (ese es
		// contabilidad de ingresos; esto es desempeño del equipo comercial) — mismo patrón de
		// grupo aparte que "accounting", RequireSales deja pasar is_sales O is_admin.
		sellers := api.Group("/admin/sellers")
		sellers.Use(middleware.RequireSales())
		{
			sellers.GET("/leaderboard", sellerH.GetLeaderboard)
			sellers.GET("/discount-codes", sellerH.ListMyDiscountCodes)
			sellers.POST("/discount-codes", sellerH.CreateMyDiscountCode)
			sellers.GET("/company-bank-info", bankH.GetCompanyBankInfo)
		}

		// Cuenta bancaria propia — Ventas, Contabilidad y admins cargan a dónde se les paga.
		meStaff := api.Group("/me")
		meStaff.Use(middleware.RequireStaff())
		{
			meStaff.GET("/bank-account", bankH.GetMyBankAccount)
			meStaff.PUT("/bank-account", bankH.UpdateMyBankAccount)
		}

		// Vista de paciente por ID (para doctores, QR, búsqueda)
		patients := api.Group("/patients")
		{
			patients.GET("/:id", patH.GetPatientByID)
			patients.GET("/:id/allergies", clinH.GetPatientAllergies)
			// Rutas exclusivas para doctores
			patients.GET("/:id/conditions", middleware.RequireDoctor(), clinH.GetPatientConditions)
			patients.GET("/:id/family-history", middleware.RequireDoctor(), clinH.GetPatientFamilyHistory)
			patients.GET("/:id/appointments", middleware.RequireDoctor(), clinH.GetPatientAppointments)
			// Descansos médicos y registros clínicos — el médico solo lee (para eso escanea el
			// QR en una emergencia); jamás escribe. Son datos del paciente, no del médico (ver
			// /me/medical-leaves y /me/clinical-records).
			patients.GET("/:id/medical-leaves", middleware.RequireDoctor(), clinH.GetPatientMedicalLeaves)
			patients.GET("/:id/clinical-records", middleware.RequireDoctor(), clinH.GetPatientClinicalRecords)
		}
	}

	return r
}
