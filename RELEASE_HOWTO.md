# Release HOWTO

To release a new version to Docker Hub, go to Github releases and create a new tag and a new release, e.g. `0.6.0`.

A Github action will automatically build and push the image to Docker hub, tagging it with the release tag version and `latest` tag, e.g.

`transifex/transifex-delivery:0.6.0`

`transifex/transifex-delivery:latest`
