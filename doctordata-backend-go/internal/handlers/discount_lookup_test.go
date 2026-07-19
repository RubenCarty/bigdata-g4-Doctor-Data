package handlers

import (
	"testing"

	"doctordata-backend-go/internal/models"
)

func TestComputeDiscountAmount(t *testing.T) {
	cases := []struct {
		name     string
		dc       models.DiscountCode
		subtotal int64
		want     int64
	}{
		{
			name:     "fixed below subtotal",
			dc:       models.DiscountCode{Type: models.DiscountFixed, AmountCents: 1000},
			subtotal: 5000,
			want:     1000,
		},
		{
			name:     "fixed capped at subtotal",
			dc:       models.DiscountCode{Type: models.DiscountFixed, AmountCents: 9000},
			subtotal: 5000,
			want:     5000,
		},
		{
			name:     "percentage",
			dc:       models.DiscountCode{Type: models.DiscountPercentage, PercentOff: 20},
			subtotal: 5000,
			want:     1000,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := computeDiscountAmount(&tc.dc, tc.subtotal)
			if got != tc.want {
				t.Errorf("computeDiscountAmount() = %d, want %d", got, tc.want)
			}
		})
	}
}
