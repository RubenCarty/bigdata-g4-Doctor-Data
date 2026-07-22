package server

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/joho/godotenv/autoload"
	"gorm.io/gorm"
)

type Server struct {
	port int
	db   *gorm.DB
}

func NewServer(db *gorm.DB) *http.Server {
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	s := &Server{
		port: port,
		db:   db,
	}

	return &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      s.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
}
