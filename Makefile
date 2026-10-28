.PHONY: test migrate seed-reset smoke sync-geo

test:
	cd backend && python -m pytest tests/ -v

migrate:
	cd backend && python -m app.migrate

seed-reset:
	python scripts/seed_reset.py

smoke:
	python scripts/smoke.py

sync-geo:
	python scripts/sync_boundaries.py
