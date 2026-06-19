#!/bin/bash
          if [[ "pull_request" == "pull_request" ]]; then
            # For PRs, modify the manifest and publish directly using --rev-version to auto-increment privately
            echo "sed -i 's/\"id\": \"asciidoc\"/\"id\": \"asciidoc-private\"/g' vss-extension.json"
            echo "sed -i 's/\"name\": \"AsciiDoc PR Viewer\"/\"name\": \"AsciiDoc PR Viewer (Private Test Version)\"/g' vss-extension.json"
            echo "tfx extension publish --manifests vss-extension.json --override \"{\\\"public\\\": false}\" --token PAT --share-with ORG --rev-version"
          fi
