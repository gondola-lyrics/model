#include <utility>

#include <gondola/lyrics/model/common/part.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::common {
	namespace {

		bool isResolved(PartType type) noexcept {
			switch (type) {
			case PartType::kOther:
			case PartType::kIntro:
			case PartType::kVerse:
			case PartType::kPreChorus:
			case PartType::kChorus:
			case PartType::kPostChorus:
			case PartType::kRefrain:
			case PartType::kBridge:
			case PartType::kInterlude:
			case PartType::kInstrumental:
			case PartType::kOutro:
				return true;
			default:
				return false;
			}
		}

	} // namespace

	Part makePart(PartType type, std::optional<std::string> id, std::optional<std::string> raw) {
		return {type, std::move(id), std::move(raw)};
	}

	std::vector<Diagnostic> validatePart(const Part& part, std::string_view path) {
		if (!isResolved(part.type)) {
			return {{utils::childPath(path, "type"), DiagnosticCode::kPartTypeUnspecified}};
		}
		if (part.type == PartType::kOther && !part.raw) {
			return {{std::string(path), DiagnosticCode::kPartRawMissing}};
		}
		return {};
	}

} // namespace gondola::lyrics::model::common
