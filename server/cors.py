"""CORS middleware for Flask application."""
from flask import Flask, Response


class CORS:
    """CORS middleware for Flask application.

    Adds Cross-Origin Resource Sharing headers to responses.
    """
    def __init__(self, app: Flask) -> None:
        """Initialize CORS with the Flask application instance."""
        self.app = app
        self.init_app(app)

    def init_app(self, app: Flask) -> None:
        """Initialize the CORS middleware for the Flask app."""
        app.after_request(self.add_cors_headers)

    def add_cors_headers(self, response: Response) -> Response:
        """Add CORS headers to the response."""
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response
