"""Custom IO handler for capturing output and file operations."""
import logging

from aider.io import InputOutput
from pathlib import Path

logger = logging.getLogger(__name__)


class InvalidMessageError(TypeError):
    """Error raised when message is not a string."""
    def __init__(self) -> None:
        """Initialize the error with a message."""
        super().__init__("message must be a string")

class InvalidFileDataError(TypeError):
    """Error raised when filename or content is not a string."""
    def __init__(self) -> None:
        """Initialize the error with a message."""
        super().__init__("filename and content must be strings")

class CaptureIO(InputOutput):
    """Custom IO handler that captures output and file operations.

    Extends InputOutput to capture all output lines, errors, and file operations
    for processing by the chat interface.
    """
    lines: list[str]
    error_lines: list[str]
    write_files: dict[str, str]

    def __init__(
        self,
        *,
        pretty: bool = False,
        yes: bool = False,
        dry_run: bool = False,
        encoding: str = "utf-8",
        fancy_input: bool = False,
    ) -> None:
        """Initialize IO capture handler."""
        self.lines = []
        # when spawned in node process, tool_error will be called
        # so we need to create before super().__init__
        self.error_lines = []
        self.write_files = {}
        super().__init__(
            pretty=pretty,
            yes=yes,
            dry_run=dry_run,
            encoding=encoding,
            fancy_input=fancy_input,
        )

    def tool_output(self, msg: str = "", *, log_only: bool = False, bold: bool = False) -> None:
        """Capture and output a message from the tool."""
        if not isinstance(msg, str):
            raise InvalidMessageError
        if not log_only:
            self.lines.append(msg)
        super().tool_output(msg, log_only=log_only, bold=bold)

    def tool_error(self, msg: str) -> None:
        """Capture error lines for processing by the chat interface."""
        self.error_lines.append(msg)
        super().tool_error(msg)

    def tool_warning(self, msg: str) -> None:
        """Capture warning lines for processing by the chat interface."""
        self.lines.append(msg)
        super().tool_warning(msg)

    def get_captured_lines(self) -> list[str]:
        """Get all captured output lines and clear the buffer."""
        lines = self.lines
        self.lines = []
        return lines

    def get_captured_error_lines(self) -> list[str]:
        """Get all captured error lines and clear the buffer."""
        lines = self.error_lines
        self.error_lines = []
        return lines

    def write_text(self, filename: str, content: str) -> None:
        """Write text content to a file.

        Args:
            filename: Path to the file to write
            content: Text content to write
        """
        if not isinstance(filename, str) or not isinstance(content, str):
            raise InvalidFileDataError
        """Capture file write operations for processing by the chat interface."""
        logger.info("Writing file: %s", filename)
        self.write_files[filename] = content

    def read_text(self, filename: str) -> str:
        """Capture file read operations for processing by the chat interface."""
        logger.info("Reading file: %s", filename)
        if filename in self.write_files:
            return self.write_files[filename]

        if not Path(filename).exists():
            error_msg = f"[Errno 2] No such file or directory: '{filename}'"
            self.tool_error(f"{filename}: unable to read: {error_msg}")
            raise FileNotFoundError(error_msg)

        try:
            return super().read_text(filename)
        except OSError as e:
            self.tool_error(f"{filename}: unable to read: {e}")
            raise

    def get_captured_write_files(self) -> dict[str, str]:
        """Get all captured file write operations and clear the buffer."""
        write_files = self.write_files
        self.write_files = {}
        return write_files

    def confirm_ask(
        self,
        question: str,
        *,
        subject: str | None = None,
        group: str | None = None,
    ) -> bool:
        """Handle confirmation prompts.

        Returns True for new file creation, False otherwise.
        """
        self.tool_output(f"confirm_ask: {question} ({subject}, {group})")
        return "Create new file" in question
