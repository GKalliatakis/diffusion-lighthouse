.PHONY: update update-no-citations serve

update:
	bash scripts/update_all.sh

update-no-citations:
	bash scripts/update_all.sh --no-citations

serve:
	bash scripts/update_all.sh --serve
