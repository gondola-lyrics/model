cmake_minimum_required(VERSION 3.21)
project(gondola_lyrics_model LANGUAGES CXX)

add_library(gondola_lyrics_model INTERFACE)
add_library(gondola::lyrics_model ALIAS gondola_lyrics_model)

target_compile_features(gondola_lyrics_model INTERFACE cxx_std_17)
target_include_directories(gondola_lyrics_model INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/include")
