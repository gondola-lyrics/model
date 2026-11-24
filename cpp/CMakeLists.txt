cmake_minimum_required(VERSION 3.21)

set(GONDOLA_LYRICS_MODEL_VERSION "1.0.0")

project(gondola_lyrics_model
  VERSION "${GONDOLA_LYRICS_MODEL_VERSION}"
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

  target_include_directories(gondola_lyrics_model INTERFACE
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
  )

  set(GONDOLA_LYRICS_MODEL_INSTALL_CMAKEDIR
    "${CMAKE_INSTALL_LIBDIR}/cmake/gondola-lyrics-model"
  )

  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/cmake/package-config.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/gondola-lyrics-model-config.cmake"
    @ONLY
  )

  include("${CMAKE_CURRENT_SOURCE_DIR}/cmake/package-version.cmake")

  install(TARGETS gondola_lyrics_model
    EXPORT gondola_lyrics_modelTargets
    ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
  )
  install(DIRECTORY include/ generated/include/
    DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}"
    FILES_MATCHING PATTERN "*.hpp"
  )
  install(EXPORT gondola_lyrics_modelTargets
    FILE gondola-lyrics-model-targets.cmake
    NAMESPACE gondola::lyrics::
    DESTINATION "${GONDOLA_LYRICS_MODEL_INSTALL_CMAKEDIR}"
  )
  install(FILES
    "${CMAKE_CURRENT_BINARY_DIR}/gondola-lyrics-model-config.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/gondola-lyrics-model-config-version.cmake"
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
