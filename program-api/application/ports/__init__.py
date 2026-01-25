"""
Port interfaces (Protocols) for program-api.

Part of AMA-461: Create program-api service scaffold

This package defines the interface contracts that the infrastructure
layer must implement. Using Protocols enables:
- Clean separation of concerns
- Easy testing with mock implementations
- Dependency inversion (depend on abstractions, not concretions)
"""

from application.ports.program_repository import ProgramRepository

__all__ = [
    "ProgramRepository",
]
