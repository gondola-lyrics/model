cmake_minimum_required(VERSION 3.21)
project(gondola_lyrics_model LANGUAGES CXX)

add_library(gondola_lyrics_model STATIC
  src/codec.cpp
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
