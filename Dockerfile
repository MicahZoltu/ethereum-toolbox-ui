FROM node:22.13.0-alpine3.20@sha256:2e897832d17a0670bb7ef7c2b4df7f2e6c3d561b5aaa2be89ff4bc12fb698e67 as builder

RUN apk add --no-cache git

ARG COMMIT_HASH

WORKDIR /source
RUN git init
RUN git remote add origin https://github.com/MicahZoltu/ethereum-toolbox-ui.git
RUN git fetch --depth 1 origin $COMMIT_HASH
RUN git checkout FETCH_HEAD
WORKDIR /source
RUN npm run setup

# --------------------------------------------------------
# Base Image: Create the base image that will host the app
# --------------------------------------------------------

# Cache the kubo image
FROM ipfs/kubo:v0.32.1@sha256:7cc0e0de8f845d6c9fa1dce414c069974c34ed3cd3742e0d4f5bccda4adc376d as ipfs-kubo

# Create the base image
FROM debian:12.8-slim@sha256:d365f4920711a9074c4bcd178e8f457ee59250426441ab2a5f8106ed8fe948eb

# Use snapshot repository and add curl & jq packages.
RUN sed -i 's/URIs/# URIs/g' /etc/apt/sources.list.d/debian.sources && \
	sed -i 's/# http/URIs: http/g' /etc/apt/sources.list.d/debian.sources && \
	apt-get update -o Acquire::Check-Valid-Until=false && apt-get install -y curl=7.88.1-10+deb12u8 jq=1.6-2.1

# Install kubo and initialize ipfs
COPY --from=ipfs-kubo /usr/local/bin/ipfs /usr/local/bin/ipfs

# Copy app's build output and initialize IPFS api
RUN ipfs init
COPY --from=builder /source/app /export
RUN ipfs add --cid-version 1 --quieter --only-hash -r /export > ipfs_hash.txt

# --------------------------------------------------------
# Publish Script: Option to host app locally or on nft.storage
# --------------------------------------------------------

WORKDIR /export
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
