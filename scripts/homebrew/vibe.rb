class Vibe < Formula
  desc "A vibe-themed CLI tool for running language model evaluations"
  homepage "https://github.com/your-org/vibecheck"
  url "https://registry.npmjs.org/@vibe/cli/-/@vibe/cli-0.1.0.tgz"
  sha256 ""
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/vibe", "--version"
  end
end

