cmake_minimum_required(VERSION 3.21)

set(GONDOLA_LYRICS_MODEL_VERSION "1.0.0")
string(REGEX REPLACE "[-+].*$" ""
  GONDOLA_LYRICS_MODEL_VERSION_CORE "${GONDOLA_LYRICS_MODEL_VERSION}"
)

project(gondola_lyrics_model
  VERSION "${GONDOLA_LYRICS_MODEL_VERSION_CORE}"
  LANGUAGES CXX
)

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
  PUBLIC include generated/include
  PRIVATE src generated/src
)
set_target_properties(gondola_lyrics_model PROPERTIES POSITION_INDEPENDENT_CODE ON)
