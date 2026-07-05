# typed: strict
# frozen_string_literal: true

cask "file-explorer" do
  version "1.0.1"
  sha256 "67b84c0909ac5725197105ec1120a975db37d1ab771386567467e6ee5ebb3b63"

  url "https://github.com/file-explorer-mac/file-explorer-mac/releases/download/v#{version}/File-Explorer-#{version}-universal.dmg",
      verified: "github.com/file-explorer-mac/file-explorer-mac/"
  name "File Explorer"
  desc "Modern, tabbed file manager"
  homepage "https://github.com/file-explorer-mac/file-explorer-mac"

  depends_on macos: :big_sur

  app "File Explorer.app"

  zap trash: [
    "~/Library/Application Support/File Explorer",
    "~/Library/Caches/com.fileexplorer.app",
    "~/Library/HTTPStorages/com.fileexplorer.app",
    "~/Library/Preferences/com.fileexplorer.app.plist",
    "~/Library/Saved Application State/com.fileexplorer.app.savedState",
  ]
end
