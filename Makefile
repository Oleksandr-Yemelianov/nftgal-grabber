help: ## Show help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <app> [app] [app]...\n\nApps: \033[36m\033[0m\n"} /^[$$()% 0-9a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
 : ##

env: ## Configure env [dev mode]
	cp .env.local .env

dev: ## Run app [dev mode]
	docker compose up -d --build

logs: ## App logs [dev mode]
	docker compose logs -f app

down: ## Down app
	docker compose down || true

down-v: ## Down app and remove volumes
	docker compose down -v || true
