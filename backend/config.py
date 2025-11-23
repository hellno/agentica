"""
Configuration and utility functions for AI Agent Launchpad.

This module provides:
- Character configuration generation (simple description → ElizaOS JSON)
- Modal.Dict tunnel URL management
- Supabase client initialization
- Input validation utilities

Usage:
    from config import generate_character_config, get_tunnel_url

    # Generate ElizaOS character config
    config = generate_character_config("CustomerBot", "Helps with support")

    # Get tunnel URL from Modal.Dict
    tunnel_url = get_tunnel_url()
"""

import os
import re
from typing import Any, Dict, Optional, Tuple

import modal
from supabase import Client, create_client

# ============================================================================
# MODAL.DICT TUNNEL URL MANAGEMENT
# ============================================================================

def get_tunnel_url() -> str:
    """
    Get the ElizaOS server URL.

    Returns the URL of the ElizaOS web server function deployed on Modal.
    This URL is stable and provided by Modal's deployment.

    Returns:
        str: The ElizaOS server URL (e.g., "https://xxx--agentica-platform-eliza-server.modal.run")

    Note:
        This URL is determined by Modal based on your workspace and function name.
        Format: https://{workspace}--{app-name}-{function-name}.modal.run
    """
    # Get from environment variable if set (for flexibility)
    eliza_url = os.environ.get("ELIZA_SERVER_URL")

    if eliza_url:
        return eliza_url

    # Default: Use Modal's stable URL format
    # This URL is automatically assigned by Modal when deploying the eliza_server function
    # You can find it in the deployment output or Modal dashboard
    raise Exception(
        "ELIZA_SERVER_URL environment variable not set. "
        "Please set it to your ElizaOS server URL (e.g., https://herocast--agentica-platform-eliza-server.modal.run)"
    )


def set_tunnel_url(url: str) -> None:
    """
    Store the ElizaOS server tunnel URL in Modal.Dict.

    Called by the ElizaOS server on startup to make the tunnel URL
    available to API endpoints.

    Args:
        url: The tunnel URL to store
    """
    tunnel_dict = modal.Dict.from_name("agentica-config", create_if_missing=True)
    tunnel_dict["tunnel_url"] = url


# ============================================================================
# SUPABASE CLIENT INITIALIZATION
# ============================================================================

def create_supabase_client() -> Client:
    """
    Initialize Supabase client with credentials from Modal secrets.

    Expects the following environment variables (provided via Modal secrets):
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access

    Returns:
        Client: Authenticated Supabase client

    Raises:
        ValueError: If required credentials are missing
        Exception: If client initialization fails
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url:
        raise ValueError("SUPABASE_URL environment variable not set")
    if not supabase_key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable not set")

    try:
        client = create_client(supabase_url, supabase_key)
        return client
    except Exception as e:
        raise Exception(f"Failed to initialize Supabase client: {str(e)}")


# ============================================================================
# INPUT VALIDATION
# ============================================================================

def validate_agent_input(
    name: str,
    description: str,
    user_id: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Validate agent creation inputs.

    Validation rules:
    - name: 3-50 characters, alphanumeric + spaces/hyphens/underscores
    - description: 10-500 characters
    - user_id: Required, non-empty string

    Args:
        name: Agent display name
        description: Agent purpose description
        user_id: Optional user identifier (required for agent creation)

    Returns:
        Tuple[bool, str]: (is_valid, error_message)
            - (True, "") if valid
            - (False, "error message") if invalid
    """
    # Validate user_id
    if user_id is not None:
        if not user_id or not isinstance(user_id, str):
            return False, "user_id is required and must be a non-empty string"
        if len(user_id) > 255:
            return False, "user_id must be 255 characters or less"

    # Validate name
    if not name or not isinstance(name, str):
        return False, "name is required and must be a string"

    name = name.strip()
    if len(name) < 3:
        return False, "name must be at least 3 characters long"
    if len(name) > 50:
        return False, "name must be 50 characters or less"

    # Allow alphanumeric, spaces, hyphens, underscores
    if not re.match(r'^[a-zA-Z0-9\s\-_]+$', name):
        return False, "name can only contain letters, numbers, spaces, hyphens, and underscores"

    # Validate description
    if not description or not isinstance(description, str):
        return False, "description is required and must be a string"

    description = description.strip()
    if len(description) < 10:
        return False, "description must be at least 10 characters long"
    if len(description) > 500:
        return False, "description must be 500 characters or less"

    return True, ""


# ============================================================================
# CHARACTER CONFIGURATION GENERATOR
# ============================================================================

def generate_character_config(
    name: str,
    description: str,
    advanced_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate ElizaOS character configuration from simple inputs.

    Converts a simple name + description into a full ElizaOS character JSON
    configuration with sensible defaults. Advanced users can override defaults
    via advanced_config parameter.

    Args:
        name: Agent display name (used for character name)
        description: Agent purpose description (used for bio and lore)
        advanced_config: Optional dict with advanced overrides
            - model_provider: "openai" or "anthropic" (default: "openai")
            - topics: List of conversation topics
            - adjectives: List of personality adjectives
            - style: Dict with style settings (all, chat, post)
            - custom_actions: List of custom action names

    Returns:
        Dict[str, Any]: Full ElizaOS character configuration

    Example:
        >>> config = generate_character_config(
        ...     "SupportBot",
        ...     "Helps users with technical support questions"
        ... )
        >>> config["name"]
        'SupportBot'
    """
    # Start with default configuration
    # Minimal schema that matches ElizaOS's expected format
    character = {
        "name": name,
        # System prompt defines the agent's core behavior
        "system": (
            f"You are {name}, an AI agent. {description} "
            "Respond to all messages in a helpful, conversational manner. "
            "Provide assistance on relevant topics, using your knowledge when needed. "
            "Be concise but thorough, friendly but professional. "
            "Use humor when appropriate and be empathetic to user needs."
        ),
        # Short bio snippets for context
        "bio": [description],
        "messageExamples": [
            [
                {
                    "name": "{{user1}}",  # ElizaOS expects 'name' not 'user'
                    "content": {
                        "text": f"Hello {name}, how can you help me?"
                    }
                },
                {
                    "name": name,
                    "content": {
                        "text": f"Hello! I'm {name}. {description} How can I assist you today?"
                    }
                }
            ],
            [
                {
                    "name": "{{user1}}",
                    "content": {
                        "text": "What can you do?"
                    }
                },
                {
                    "name": name,
                    "content": {
                        "text": f"I'm here to help! {description} Feel free to ask me anything related to my purpose."
                    }
                }
            ]
        ],
        "postExamples": [
            f"As {name}, I'm always ready to assist.",
            f"{description}",
            "Feel free to reach out anytime you need help!"
        ],
        "topics": [
            "assistance",
            "problem solving",
            "helpful conversation",
            "user support"
        ],
        "adjectives": [
            "helpful",
            "knowledgeable",
            "friendly",
            "professional",
            "efficient",
            "reliable"
        ],
        "style": {
            "all": [
                "be helpful and informative",
                "maintain a friendly and professional tone",
                "provide clear and concise responses",
                "stay focused on assisting the user"
            ],
            "chat": [
                "engage in natural conversation",
                "ask clarifying questions when needed",
                "provide step-by-step guidance"
            ],
            "post": [
                "share useful information",
                "be encouraging and supportive"
            ]
        },
        # Hardcoded plugins - not user-configurable
        "plugins": [
            "@elizaos/adapter-postgres",  # PostgreSQL adapter (no PGLite fallback)
            "@elizaos/plugin-openai",
            "@elizaos/plugin-bootstrap",
            "price-monitor",  # Custom price monitoring plugin
            "trade-monitor"   # Custom trade activity monitoring plugin
            # NOTE: Custom plugins need to be available to the ElizaOS server.
            # For local development with backend/agentica, this works.
            # For production Modal deployment, you need to either:
            #   1. Publish as npm package and include in ElizaOS Docker image, or
            #   2. Build custom Docker image with the plugin included
        ],
        # Hardcoded settings - not user-configurable
        "settings": {
            "secrets": {},
            "voice": {
                "model": "en_US-male-medium"
            }
        }
    }

    # Apply advanced configuration overrides (limited to safe fields only)
    if advanced_config:
        # Allow customizing topics
        if "topics" in advanced_config and isinstance(advanced_config["topics"], list):
            character["topics"] = advanced_config["topics"]

        # Allow customizing adjectives
        if "adjectives" in advanced_config and isinstance(advanced_config["adjectives"], list):
            character["adjectives"] = advanced_config["adjectives"]

        # Allow customizing style (but merge, don't replace)
        if "style" in advanced_config and isinstance(advanced_config["style"], dict):
            for key in ["all", "chat", "post"]:
                if key in advanced_config["style"]:
                    character["style"][key] = advanced_config["style"][key]

        # Note: plugins and settings are hardcoded and cannot be overridden for security

    return character


# ============================================================================
# ELIZA API HELPERS
# ============================================================================

def get_eliza_api_url(endpoint: str) -> str:
    """
    Construct full ElizaOS API URL for a given endpoint.

    Args:
        endpoint: API endpoint path (e.g., "/api/agents")

    Returns:
        str: Full API URL

    Example:
        >>> get_eliza_api_url("/api/agents")
        'https://xxx.modal.run/api/agents'
    """
    tunnel_url = get_tunnel_url()
    # Remove trailing slash from tunnel URL if present
    tunnel_url = tunnel_url.rstrip("/")
    # Ensure endpoint starts with /
    if not endpoint.startswith("/"):
        endpoint = f"/{endpoint}"
    return f"{tunnel_url}{endpoint}"
