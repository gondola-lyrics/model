cmake_minimum_required(VERSION 3.21)

set(GONDOLA_LYRICS_MODEL_VERSION "1.0.0")
string(REGEX REPLACE "[-+].*$" ""
  GONDOLA_LYRICS_MODEL_VERSION_CORE "${GONDOLA_LYRICS_MODEL_VERSION}"
)

project(gondola_lyrics_model
  VERSION "${GONDOLA_LYRICS_MODEL_VERSION_CORE}"
  LANGUAGES CXX
)

option(GONDOLA_LYRICS_MODEL_INSTALL "Install model package" ${PROJECT_IS_TOP_LEVEL})
option(GONDOLA_LYRICS_MODEL_BUILD_TESTS "Build model tests" OFF)

add_library(gondola_lyrics_model STATIC
  src/codec.cpp
  src/common/agent.cpp
  src/common/diagnostic.cpp
  src/common/language.cpp
  src/common/meta.cpp
  src/common/part.cpp
  src/common/text.cpp
  src/common/time.cpp
  src/common/unknown.cpp
  src/document/line.cpp
  src/document/lyric.cpp
  src/document/word.cpp
  src/enriched/language.cpp
  src/enriched/line.cpp
  src/enriched/lyric.cpp
  src/enriched/word.cpp
  src/utils/wire.cpp
  generated/src/utils/codec.gen.cpp
)
add_library(gondola::lyrics::model ALIAS gondola_lyrics_model)

target_compile_features(gondola_lyrics_model PUBLIC cxx_std_17)
target_include_directories(gondola_lyrics_model
  PUBLIC
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/generated/include>"
  PRIVATE src generated/src
)
set_target_properties(gondola_lyrics_model PROPERTIES
  CXX_EXTENSIONS OFF
  DEBUG_POSTFIX "_d"
  EXPORT_NAME model
  POSITION_INDEPENDENT_CODE ON
)

if(GONDOLA_LYRICS_MODEL_BUILD_TESTS)
  enable_testing()
  add_executable(gondola_lyrics_model_tests
    test/main.cpp
    test/codec.cpp
    test/common.cpp
    test/helpers.cpp
    test/validate.cpp
    test/canonicalize.cpp
    test/order.cpp
    test/roman.cpp
    test/text_token.cpp
  )
  target_link_libraries(gondola_lyrics_model_tests PRIVATE gondola::lyrics::model)
  set_target_properties(gondola_lyrics_model_tests PROPERTIES CXX_EXTENSIONS OFF)
  foreach(suite codec common helpers validate canonicalize order roman text_token)
    add_test(NAME gondola_lyrics_model.${suite} COMMAND gondola_lyrics_model_tests ${suite})
  endforeach()
endif()

if(GONDOLA_LYRICS_MODEL_INSTALL)
  include(GNUInstallDirs)
  include(CMakePackageConfigHelpers)

  target_include_directories(gondola_lyrics_model INTERFACE
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
  )

  set(GONDOLA_LYRICS_MODEL_INSTALL_CMAKEDIR
    "${CMAKE_INSTALL_LIBDIR}/cmake/gondola_lyrics_model"
  )

  string(CONFIGURE [=[
set(gondola_lyrics_model_VERSION "@GONDOLA_LYRICS_MODEL_VERSION@")

if(gondola_lyrics_model_VERSION MATCHES "^[^+]*-" AND NOT gondola_lyrics_model_ALLOW_PRERELEASE)
  set(gondola_lyrics_model_FOUND FALSE)
  set(gondola_lyrics_model_NOT_FOUND_MESSAGE
    "Model package ${gondola_lyrics_model_VERSION} is a prerelease; set gondola_lyrics_model_ALLOW_PRERELEASE to ON to use it"
  )
  return()
endif()

foreach(component IN LISTS gondola_lyrics_model_FIND_COMPONENTS)
  if(gondola_lyrics_model_FIND_REQUIRED_${component})
    set(gondola_lyrics_model_FOUND FALSE)
    set(gondola_lyrics_model_NOT_FOUND_MESSAGE "Model package does not provide components")
    return()
  endif()
endforeach()

include("${CMAKE_CURRENT_LIST_DIR}/gondola_lyrics_modelTargets.cmake")
]=] GONDOLA_LYRICS_MODEL_CONFIG @ONLY)
  file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfig.cmake"
    "${GONDOLA_LYRICS_MODEL_CONFIG}"
  )

  # CMake compares the numeric core; preserve SemVer and require opt-in for prereleases.
  write_basic_package_version_file(
    "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfigVersion.cmake"
    VERSION "${GONDOLA_LYRICS_MODEL_VERSION_CORE}"
    COMPATIBILITY SameMajorVersion
  )
  file(READ
    "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfigVersion.cmake"
    GONDOLA_LYRICS_MODEL_VERSION_CHECK
  )
  string(CONFIGURE [=[
set(PACKAGE_VERSION "@GONDOLA_LYRICS_MODEL_VERSION@")

if(PACKAGE_VERSION MATCHES "^[^+]*-" AND NOT gondola_lyrics_model_ALLOW_PRERELEASE)
  set(PACKAGE_VERSION_COMPATIBLE FALSE)
  set(PACKAGE_VERSION_EXACT FALSE)
  set(PACKAGE_VERSION_UNSUITABLE TRUE)
  return()
endif()

@GONDOLA_LYRICS_MODEL_VERSION_CHECK@

if(NOT PACKAGE_VERSION_UNSUITABLE)
  set(PACKAGE_VERSION "@GONDOLA_LYRICS_MODEL_VERSION@")
endif()
]=] GONDOLA_LYRICS_MODEL_VERSION_CHECK @ONLY)
  file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfigVersion.cmake"
    "${GONDOLA_LYRICS_MODEL_VERSION_CHECK}"
  )

  install(TARGETS gondola_lyrics_model
    EXPORT gondola_lyrics_modelTargets
    ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  )
  install(DIRECTORY include/ generated/include/
    DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}"
    FILES_MATCHING PATTERN "*.hpp"
  )
  install(EXPORT gondola_lyrics_modelTargets
    FILE gondola_lyrics_modelTargets.cmake
    NAMESPACE gondola::lyrics::
    DESTINATION "${GONDOLA_LYRICS_MODEL_INSTALL_CMAKEDIR}"
  )
  install(FILES
    "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfig.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/gondola_lyrics_modelConfigVersion.cmake"
    DESTINATION "${GONDOLA_LYRICS_MODEL_INSTALL_CMAKEDIR}"
  )

  if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE")
    set(GONDOLA_LYRICS_MODEL_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE")
  elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../proto/VERSION.txt" AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE")
    set(GONDOLA_LYRICS_MODEL_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE")
  else()
    message(FATAL_ERROR "Model package LICENSE is missing")
  endif()
  install(FILES "${GONDOLA_LYRICS_MODEL_LICENSE}"
    DESTINATION "${CMAKE_INSTALL_DATAROOTDIR}/licenses/gondola_lyrics_model"
  )
endif()
