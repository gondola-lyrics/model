include(CMakePackageConfigHelpers)

write_basic_package_version_file(
  "${CMAKE_CURRENT_BINARY_DIR}/gondola-lyrics-model-config-version.cmake"
  VERSION "${GONDOLA_LYRICS_MODEL_VERSION}"
  COMPATIBILITY SameMajorVersion
)
