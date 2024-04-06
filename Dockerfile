FROM node:21.7.2-alpine3.18@sha256:d3398787ac2f4d83206293be6b41371a628383eadaf7fb108faab63d13c5469e as builder

RUN apk add --no-cache git

WORKDIR /
RUN git clone https://github.com/MicahZoltu/ethereum-toolbox-ui.git
WORKDIR /ethereum-toolbox-ui
RUN npm run setup

# --------------------------------------------------------
# Base Image: Create the base image that will host the app
# --------------------------------------------------------

# Cache the kubo image
FROM ipfs/kubo:v0.27.0@sha256:bfce363b878b8e1512009d9bb5b732b6bc8469296ca50f75ff3c6f227dc179b2 as ipfs-kubo

# Create the base image
FROM debian:12.2-slim@sha256:93ff361288a7c365614a5791efa3633ce4224542afb6b53a1790330a8e52fc7d

# Add curl to the base image (7.88.1-10+deb12u5)
# Add jq to the base image (1.6-2.1)
RUN apt-get update && apt-get install -y curl=7.88.1-10+deb12u5 jq=1.6-2.1

# Install kubo and initialize ipfs
COPY --from=ipfs-kubo /usr/local/bin/ipfs /usr/local/bin/ipfs

# Copy app's build output and initialize IPFS api
COPY --from=builder /ethereum-toolbox-ui/app /export
RUN ipfs init
RUN ipfs add --cid-version 1 --quieter --only-hash -r /export > ipfs_hash.txt

# --------------------------------------------------------
# Publish Script: Option to host app locally or on nft.storage
# --------------------------------------------------------

WORKDIR /app
COPY <<'EOF' /entrypoint.sh
#!/bin/sh
set -e

if [ $# -ne  1 ]; then
	echo "Example usage: docker run --rm ghcr.io/darkflorist/lunaria:latest [docker-host|nft.storage]"
	exit  1
fi

case $1 in

	docker-host)
		# Show the IFPS build hash
		echo "Build Hash: $(cat /ipfs_hash.txt)"

		# Determine the IPV4 address of the docker-hosted IPFS instance
		IPFS_IP4_ADDRESS=$(getent ahostsv4 host.docker.internal | grep STREAM | head -n 1 | cut -d ' ' -f 1)

		echo "Adding files to docker running IPFS at $IPFS_IP4_ADDRESS"
		IPFS_HASH=$(ipfs add --api /ip4/$IPFS_IP4_ADDRESS/tcp/5001 --cid-version 1 --quieter -r /export)
		echo "Uploaded Hash: $IPFS_HASH"
		;;

	nft.storage)
		if [ -z $NFTSTORAGE_API_KEY ] || [ $NFTSTORAGE_API_KEY = "" ]; then
			echo "NFTSTORAGE_API_KEY environment variable is not set";
			exit  1;
		fi

		# Show the IFPS build hash
		echo "Build Hash: $(cat /ipfs_hash.txt)"

		# Create a CAR archive from build hash
		echo "Uploading files to nft.storage..."
		IPFS_HASH=$(ipfs add --cid-version 1 --quieter -r /export)
		ipfs dag export $IPFS_HASH > output.car

		# Upload the entire directory to nft.storage
		UPLOAD_RESPONSE=$(curl \
			--request POST \
			--header "Authorization: Bearer $NFTSTORAGE_API_KEY" \
			--header "Content-Type: application/car" \
			--data-binary @output.car \
			--silent \
			https://api.nft.storage/upload)

		# Show link to nft.storage (https://xxx.ipfs.nftstorage.link)
		UPLOAD_SUCCESS=$(echo "$UPLOAD_RESPONSE" | jq -r ".ok")

		if [ "$UPLOAD_SUCCESS" = "true" ]; then
			echo "Succesfully uploaded to https://"$(echo "$UPLOAD_RESPONSE" | jq -r ".value.cid")".ipfs.nftstorage.link"
		else
			echo "Upload Failed: " $(echo "$UPLOAD_RESPONSE" | jq -r ".error | @json")
		fi
		;;

	*)
		echo "Invalid option: $1"
		echo "Example usage: docker run --rm ghcr.io/darkflorist/lunaria:latest [docker-host|nft.storage]"
		exit  1
		;;
esac
EOF

RUN chmod u+x /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
