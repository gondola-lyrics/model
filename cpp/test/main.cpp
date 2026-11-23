#include "test.hpp"

int main(int argc, char* argv[]) {
	using namespace gondola::lyrics::model::test;
	struct Suite {
		std::string_view name;
		int (*run)();
	};
	const Suite suites[] = {
		{"codec", codecTests},
		{"common", commonTests},
		{"helpers", helpersTests},
		{"validate", validateTests},
		{"canonicalize", canonicalizeTests},
		{"order", orderTests},
		{"roman", romanTests},
		{"text_token", textTokenTests},
	};
	if (argc > 2) {
		std::cerr << "Expected at most one suite name\n";
		return EXIT_FAILURE;
	}
	bool matched  = false;
	int  failures = 0;
	for (const auto& suite : suites) {
		if (argc == 1 || suite.name == argv[1]) {
			matched = true;
			failures += suite.run();
		}
	}
	if (!matched) {
		std::cerr << "Unknown test suite: " << argv[1] << '\n';
	}
	return matched && failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
