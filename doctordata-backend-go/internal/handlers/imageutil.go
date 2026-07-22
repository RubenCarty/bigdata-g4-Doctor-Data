package handlers

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"math"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	maxOutputBytes = 1 << 20 // 1 MB
	maxDimension   = 1920    // píxeles en el lado más largo
	startQuality   = 85
	minQuality     = 30
	qualityStep    = 12
)

// toJPEG decodifica cualquier imagen soportada (JPEG, PNG, GIF, WebP, BMP, TIFF),
// la redimensiona si supera 1920 px en su lado más largo y la comprime a JPEG
// reduciendo calidad hasta que el resultado quepa en 1 MB.
func toJPEG(r io.Reader) ([]byte, error) {
	img, _, err := image.Decode(r)
	if err != nil {
		return nil, fmt.Errorf("formato de imagen no válido o no soportado")
	}

	img = resizeIfNeeded(img, maxDimension)

	quality := startQuality
	for {
		buf, encErr := encodeJPEG(img, quality)
		if encErr != nil {
			return nil, fmt.Errorf("error al procesar la imagen")
		}
		if len(buf) <= maxOutputBytes || quality <= minQuality {
			return buf, nil
		}
		// Aún pesa más de 1 MB: bajamos calidad
		quality -= qualityStep
		if quality < minQuality {
			quality = minQuality
		}
	}
}

func encodeJPEG(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func resizeIfNeeded(img image.Image, maxPx int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxPx && h <= maxPx {
		return img
	}

	var newW, newH int
	if w >= h {
		newW = maxPx
		newH = int(math.Round(float64(h) * float64(maxPx) / float64(w)))
	} else {
		newH = maxPx
		newW = int(math.Round(float64(w) * float64(maxPx) / float64(h)))
	}
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
	return dst
}

// isImageMIME acepta cualquier tipo MIME de imagen.
func isImageMIME(mime string) bool {
	return strings.HasPrefix(mime, "image/")
}
