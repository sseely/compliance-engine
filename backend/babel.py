"""
Babel CLI configuration for Compliance Engine internationalization
Manages translation extraction, compilation, and locale setup
"""

from fastapi_babel import Babel, BabelConfigs

# Babel configuration for compliance engine
configs = BabelConfigs(
    ROOT_DIR=__file__,
    BABEL_DEFAULT_LOCALE="en",
    BABEL_TRANSLATION_DIRECTORY="locales",
    BABEL_CONFIG_FILE="babel.cfg",
)

babel = Babel(configs=configs)

if __name__ == "__main__":
    babel.run_cli()