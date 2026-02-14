.PHONY: backend-setup backend-run frontend-run

backend-setup:
	./scripts/bootstrap_backend.sh

backend-run:
	./scripts/run_backend.sh

frontend-run:
	./scripts/run_frontend.sh
