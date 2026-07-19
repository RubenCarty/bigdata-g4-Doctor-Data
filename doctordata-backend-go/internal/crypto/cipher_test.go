package crypto

import (
	"encoding/base64"
	"os"
	"testing"
)

func setTestKey(t *testing.T) {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	old := os.Getenv("ENCRYPTION_KEY")
	os.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))
	t.Cleanup(func() { os.Setenv("ENCRYPTION_KEY", old) })
	MustInit()
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	setTestKey(t)

	plaintext := "Juan Pérez — DNI 12345678"
	ciphertext, err := encryptString(plaintext)
	if err != nil {
		t.Fatalf("encryptString failed: %v", err)
	}
	if ciphertext == plaintext {
		t.Fatal("ciphertext should not equal plaintext")
	}

	got, err := decryptString(ciphertext)
	if err != nil {
		t.Fatalf("decryptString failed: %v", err)
	}
	if got != plaintext {
		t.Fatalf("round trip mismatch: got %q, want %q", got, plaintext)
	}
}

func TestEncryptSameValueTwiceProducesDifferentCiphertext(t *testing.T) {
	setTestKey(t)

	a, err := encryptString("same value")
	if err != nil {
		t.Fatal(err)
	}
	b, err := encryptString("same value")
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("expected different ciphertext for the same plaintext (random nonce)")
	}
}

func TestDecryptWithWrongKeyFails(t *testing.T) {
	setTestKey(t)
	ciphertext, err := encryptString("secret")
	if err != nil {
		t.Fatal(err)
	}

	// Re-init with a different key.
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(255 - i)
	}
	os.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))
	MustInit()

	if _, err := decryptString(ciphertext); err == nil {
		t.Fatal("expected decryption to fail with the wrong key")
	}
}

func TestDecryptTamperedCiphertextFails(t *testing.T) {
	setTestKey(t)
	ciphertext, err := encryptString("secret")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	raw[len(raw)-1] ^= 0xFF // flip a byte in the auth tag
	tampered := base64.StdEncoding.EncodeToString(raw)

	if _, err := decryptString(tampered); err == nil {
		t.Fatal("expected decryption to fail on tampered ciphertext")
	}
}

func TestEncryptedStringGormRoundTrip(t *testing.T) {
	setTestKey(t)

	var e EncryptedString = "hello"
	dv, err := e.Value()
	if err != nil {
		t.Fatal(err)
	}

	var scanned EncryptedString
	if err := scanned.Scan(dv); err != nil {
		t.Fatal(err)
	}
	if scanned != "hello" {
		t.Fatalf("got %q, want %q", scanned, "hello")
	}

	// nil column value should scan to empty string, not error.
	var fromNil EncryptedString
	if err := fromNil.Scan(nil); err != nil {
		t.Fatal(err)
	}
	if fromNil != "" {
		t.Fatalf("expected empty string for nil scan, got %q", fromNil)
	}
}
