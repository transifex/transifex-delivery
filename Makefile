# OSX uses the group id `20` for the user & alpine has already a group
# with that id causing compatibility issues
# This conditional checks if group id `20` is used and uses `1111` instead.
GROUP_ID?=$$(if [ $$(id -g) = '20' ]; then echo 1111; else id -g; fi)
USER_ID?=$$(id -u)

TARGET_TAG=latest

build:
	make _build TARGET_IMAGE=transifex-delivery-devel

build_prod:
	make _build TARGET_IMAGE=transifex-delivery

_build:
	docker build \
		--build-arg USER_ID=${USER_ID} \
		--build-arg GROUP_ID=${GROUP_ID} \
		--target ${TARGET_IMAGE} \
		-t ${TARGET_IMAGE}:${TARGET_TAG} .

up:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

eslint:
	docker-compose run --rm transifex-delivery npm run eslint

ci-tests:
	docker-compose run --rm transifex-delivery npm test

test:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm transifex-delivery npm test

stop:
	docker-compose stop

shell:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm transifex-delivery sh

delete:
	docker-compose down --rmi local -v

debug:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --service-ports transifex-delivery npm run start-debugger
