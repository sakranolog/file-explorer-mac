# typed: strict
# frozen_string_literal: true

cask "file-explorer" do
  version "1.0.2"
  sha256 "91585bac004fa231cdba33284a67a03bda2efb75b67caff08f960dacc95e37e1"

  url "https://github.com/sakranolog/file-explorer-mac/releases/download/v#{version}/File-Explorer-#{version}-universal.dmg",
      verified: "github.com/sakranolog/file-explorer-mac/"
  name "File Explorer"
  desc "Modern, tabbed file manager"
  homepage "https://github.com/sakranolog/file-explorer-mac"

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
