package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/database"
	"doctordata-backend-go/internal/renewal"
	"doctordata-backend-go/internal/server"
)

func gracefulShutdown(apiServer *http.Server, done chan bool) {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()

	log.Println("shutting down gracefully, press Ctrl+C again to force")
	stop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := apiServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown with error: %v", err)
	}

	log.Println("Server exiting")
	done <- true
}

func main() {
	// Igual que ENCRYPTION_KEY (crypto.MustInit): sin esto, el servidor firmaría/validaría
	// JWTs con una clave vacía en vez de fallar rápido y visible.
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET no está definido — el servidor no debe arrancar sin él")
	}

	// El binario corre en un contenedor "scratch" (sin /etc/localtime ni zoneinfo del SO), así
	// que sin esto time.Local resuelve a UTC y todo time.Now() (JWTs, timestamps de negocio,
	// AuditLog, EncryptedTime) queda en UTC. El import en blanco de time/tzdata embebe la base
	// de datos de husos horarios IANA directo en el binario para que LoadLocation funcione acá.
	lima, err := time.LoadLocation("America/Lima")
	if err != nil {
		log.Fatalf("No se pudo cargar el huso horario America/Lima: %v", err)
	}
	time.Local = lima

	db, err := database.New()
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	crypto.MustInit()

	if err := database.Migrate(db); err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	database.SeedSuperAdmin(db)

	go renewal.StartScheduler(db)

	srv := server.NewServer(db)

	done := make(chan bool, 1)
	go gracefulShutdown(srv, done)

	err = srv.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		panic(fmt.Sprintf("http server error: %s", err))
	}

	<-done
	log.Println("Graceful shutdown complete.")
}
