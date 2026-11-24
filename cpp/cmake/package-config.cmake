set(gondola-lyrics-model_VERSION "@GONDOLA_LYRICS_MODEL_VERSION@")

foreach(component IN LISTS gondola-lyrics-model_FIND_COMPONENTS)
  if(gondola-lyrics-model_FIND_REQUIRED_${component})
    set(gondola-lyrics-model_FOUND FALSE)
    set(gondola-lyrics-model_NOT_FOUND_MESSAGE "Model package does not provide components")
    return()
  endif()
endforeach()

include("${CMAKE_CURRENT_LIST_DIR}/gondola-lyrics-model-targets.cmake")

get_property(_gondola_lyrics_model_imported TARGET gondola::lyrics::model PROPERTY IMPORTED)
if(_gondola_lyrics_model_imported)
  # CMake otherwise falls back to any installed configuration, which can mix incompatible CRTs.
  foreach(_gondola_lyrics_model_config IN ITEMS
    NOCONFIG Debug Release RelWithDebInfo MinSizeRel ${CMAKE_CONFIGURATION_TYPES} ${CMAKE_BUILD_TYPE}
  )
    string(TOUPPER "${_gondola_lyrics_model_config}" _gondola_lyrics_model_config)
    get_property(_gondola_lyrics_model_mapping_set TARGET gondola::lyrics::model
      PROPERTY "MAP_IMPORTED_CONFIG_${_gondola_lyrics_model_config}" SET
    )
    if(_gondola_lyrics_model_mapping_set)
      continue()
    endif()

    if(DEFINED CMAKE_MAP_IMPORTED_CONFIG_${_gondola_lyrics_model_config})
      set(_gondola_lyrics_model_mapping "${CMAKE_MAP_IMPORTED_CONFIG_${_gondola_lyrics_model_config}}")
    elseif(_gondola_lyrics_model_config STREQUAL "RELWITHDEBINFO" OR _gondola_lyrics_model_config STREQUAL "MINSIZEREL")
      set(_gondola_lyrics_model_mapping "${_gondola_lyrics_model_config};RELEASE")
    else()
      set(_gondola_lyrics_model_mapping "${_gondola_lyrics_model_config}")
    endif()

    set_property(TARGET gondola::lyrics::model
      PROPERTY "MAP_IMPORTED_CONFIG_${_gondola_lyrics_model_config}" "${_gondola_lyrics_model_mapping}"
    )
  endforeach()
endif()
unset(_gondola_lyrics_model_imported)
unset(_gondola_lyrics_model_config)
unset(_gondola_lyrics_model_mapping_set)
unset(_gondola_lyrics_model_mapping)
