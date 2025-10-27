"""Utility per il seeding utenti nel gateway."""

from __future__ import annotations

import argparse
import os

from app import create_app
from app.auth.service import AuthService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crea o garantisce un utente per il gateway")
    parser.add_argument(
        "--email",
        help="Email dell'utente da creare (default: usa DEFAULT_ADMIN_EMAIL)",
    )
    parser.add_argument(
        "--password",
        help="Password dell'utente (default: usa DEFAULT_ADMIN_PASSWORD)",
    )
    parser.add_argument(
        "--roles",
        default="admin",
        help="Lista di ruoli separati da virgola (default: admin)",
    )
    parser.add_argument(
        "--ensure-default",
        action="store_true",
        help="Forza la creazione dell'utente di default definito nelle variabili d'ambiente.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    app = create_app()
    with app.app_context():
        service = AuthService()

        if args.ensure_default or not args.email or not args.password:
            email = args.email or app.config["DEFAULT_ADMIN_EMAIL"]
            password = args.password or app.config["DEFAULT_ADMIN_PASSWORD"]
            result = service.ensure_default_user(email=email, password=password)
            status = "creato" if result.get("created") else "già presente"
            print(f"Utente {result['email']} {status} con ruolo admin")
            return

        roles = [role.strip() for role in args.roles.split(",") if role.strip()]
        try:
            user = service.register_user(email=args.email, password=args.password, roles=roles)
        except ValueError as exc:
            print(f"Errore: {exc}")
            return

        print(f"Creato utente {user.email} con ruoli {', '.join(user.roles)}")


if __name__ == "__main__":
    main()
