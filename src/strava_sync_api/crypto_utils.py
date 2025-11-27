"""Encryption utilities for token storage."""
from cryptography.fernet import Fernet
import base64
from typing import Optional


class TokenEncryption:
    """Handles encryption/decryption of tokens at rest."""
    
    def __init__(self, encryption_key: str):
        """
        Initialize encryption with a key.
        
        Args:
            encryption_key: Base64 encoded 32-byte Fernet key
        """
        # Ensure the key is properly formatted as a Fernet key
        if isinstance(encryption_key, str):
            key_bytes = encryption_key.encode()
        else:
            key_bytes = encryption_key
        
        # Fernet keys must be 32 bytes, base64url encoded
        try:
            # Try to use as Fernet key directly
            self.cipher = Fernet(key_bytes)
        except ValueError:
            # If key is not valid, pad or truncate to 32 bytes and encode
            if len(key_bytes) != 32:
                # Pad with zeros or truncate to 32 bytes
                key_bytes = (key_bytes[:32] + b'\x00' * 32)[:32]
            # Ensure it's base64url encoded
            key_b64 = base64.urlsafe_b64encode(key_bytes)
            self.cipher = Fernet(key_b64)
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt a token."""
        return self.cipher.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a token."""
        return self.cipher.decrypt(ciphertext.encode()).decode()


# Global instance (will be initialized in main)
_encryption: Optional[TokenEncryption] = None


def init_encryption(encryption_key: str):
    """Initialize global encryption instance."""
    global _encryption
    _encryption = TokenEncryption(encryption_key)


def encrypt_token(token: str) -> str:
    """Encrypt a token using global encryption."""
    if _encryption is None:
        raise RuntimeError("Encryption not initialized")
    return _encryption.encrypt(token)


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token using global encryption."""
    if _encryption is None:
        raise RuntimeError("Encryption not initialized")
    return _encryption.decrypt(encrypted_token)

