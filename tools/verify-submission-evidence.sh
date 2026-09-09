#!/usr/bin/env bash
set -euo pipefail

pfda_root="$(git rev-parse --show-toplevel)"
cd "$pfda_root"

manifest="deployments/unichain-sepolia.json"
repo_url="https://github.com/Sarnav07/Kairos"
feedback_url="$repo_url/blob/main/FEEDBACK.md"

jq -e '
  .network == "Unichain Sepolia"
  and .chainId == 1301
  and .deployerAndProceedsRecipient == "0x54560095593B57Ad71572336037435Ff1E50E4EA"
  and .contracts.pfdaAuction.address == "0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73"
  and .contracts.pfdaExecutor.address == "0x479E644B05876C6AD98cE59C2Fc94FB6C0E6b231"
  and .contracts.pfdaFeeHook.address == "0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8"
  and .poolBootstrap.poolId == "0x34626ba06dcca06958a701102c32034d3e0f035d9ea1629ec803e3cc8a093d4d"
  and .submissionEvidence.repository == "https://github.com/Sarnav07/Kairos"
  and .submissionEvidence.twoBidderRehearsal.status == "pending"
  and .submissionEvidence.demoVideo.status == "pending"
  and .submissionEvidence.feedbackForm.status == "pendingUserAction"
' "$manifest" >/dev/null

test "$(git remote get-url origin)" = "https://github.com/Sarnav07/Kairos.git"
rg -Fq "$feedback_url" FEEDBACK.md
rg -Fq "docs/EVIDENCE.md" README.md

urls=(
  "$repo_url"
  "$feedback_url"
  "https://sepolia.uniscan.xyz/tx/0x55377286f6f02e3700f3fb7aab59b9fddb9874bb8c601882edbefacb4ae98aa4"
  "https://sepolia.uniscan.xyz/tx/0xb03867062d0fe03e36c8259890fe2473ca8cfd38b053f02facbe492c6119895f"
  "https://sepolia.uniscan.xyz/tx/0x36c7162a5652776509e28247a1579dab667d9c109d2db81c93c3e150c223c0bf"
  "https://sepolia.uniscan.xyz/tx/0x461c21c8aec5db56090fd88d604c06b9fc4fbaf0fa1e41948702dd110cbf57a5"
  "https://sepolia.uniscan.xyz/tx/0xe98738897c5f753b57aca3cad109c20f7d6964cadf38b5ddc738013bd7065280"
  "https://sepolia.uniscan.xyz/tx/0xbcb63c1e630e11597489dfc5b0d407e25862cfb3552dbb2df6512462f191894d"
)

for url in "${urls[@]}"; do
  code="$(curl --location --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 "$url")"
  if [[ "$code" -lt 200 || "$code" -ge 400 ]]; then
    echo "Evidence URL did not resolve: $url (HTTP $code)" >&2
    exit 1
  fi
done

echo "Submission evidence verified: public infrastructure resolves; rehearsal, video, and feedback form remain pending."
