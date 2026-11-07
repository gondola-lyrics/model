import com.diffplug.spotless.LineEnding
import com.vanniktech.maven.publish.DeploymentValidation
import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinJvm
import com.vanniktech.maven.publish.SourcesJar
import org.gradle.jvm.tasks.Jar
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

group = "io.github.gondola-lyrics"

version = "1.0.0"

description = "Gondola lyrics data model for Kotlin and Java"

plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.protobuf)
    alias(libs.plugins.spotless)
    alias(libs.plugins.maven.publish)
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(21))
    sourceCompatibility = JavaVersion.VERSION_1_8
    targetCompatibility = JavaVersion.VERSION_1_8
}

kotlin {
    jvmToolchain(21)
    // Consumers read metadata at most one version ahead of their compiler.
    coreLibrariesVersion = libs.versions.kotlin.stdlib.get()
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_1_8)
        languageVersion.set(KotlinVersion.KOTLIN_2_2)
        apiVersion.set(KotlinVersion.KOTLIN_2_2)
        freeCompilerArgs.add("-Xjdk-release=8")
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(8)
    options.encoding = "UTF-8"
}

dependencies {
    api(libs.protobuf.java)
    api(libs.protobuf.kotlin)
    testImplementation(kotlin("test-junit5"))
    testImplementation(platform(libs.junit.bom))
    testRuntimeOnly(libs.junit.jupiter.engine)
    testRuntimeOnly(libs.junit.platform.launcher)
}

sourceSets {
    main {
        proto {
            srcDir("../proto")
        }
    }
}

protobuf {
    protoc {
        artifact = libs.protobuf.protoc.get().toString()
    }
    generateProtoTasks {
        all().configureEach {
            builtins {
                create("kotlin")
            }
        }
    }
}

abstract class GenerateSchemaVersion : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val schemaVersionFile: RegularFileProperty

    @get:OutputDirectory abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun generate() {
        val schemaVersion = schemaVersionFile.get().asFile.readText().trim()
        val semver =
            Regex(
                "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
                    "(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?" +
                    "(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$",
            )
        require(semver.matches(schemaVersion)) {
            "proto/VERSION.txt must contain a semantic version"
        }

        val output = outputDirectory.file("gondola/lyrics/model/Version.kt").get().asFile
        output.parentFile.mkdirs()
        output.writeText(
            """
            |// Generated from proto/VERSION.txt; do not edit.
            |package gondola.lyrics.model
            |
            |/**
            | * Version of the Protobuf schema used to generate these bindings.
            | *
            | * Producers write this value into the lyric's version field.
            | */
            |public const val SCHEMA_VERSION: String = "$schemaVersion"
            |
            """
                .trimMargin(),
        )
    }
}

val generateSchemaVersion =
    tasks.register<GenerateSchemaVersion>("generateSchemaVersion") {
        group = "build"
        description = "Generates the schema version carried by the bindings."
        schemaVersionFile.set(layout.projectDirectory.file("../proto/VERSION.txt"))
        outputDirectory.set(layout.buildDirectory.dir("generated/sources/version/main/kotlin"))
    }

val generatedProtoKotlin = files(layout.buildDirectory.dir("generated/sources/proto/main/kotlin")).builtBy("generateProto")

kotlin.sourceSets.named("main") {
    kotlin.srcDir(generatedProtoKotlin)
    kotlin.srcDir(generateSchemaVersion.flatMap { it.outputDirectory })
}

tasks.test {
    useJUnitPlatform()
}

tasks.withType<Jar>().configureEach {
    from(layout.projectDirectory.file("../LICENSE")) {
        into("META-INF")
    }
}

tasks.jar {
    // Schema paths such as common/time.proto are too generic to share the classpath root.
    exclude("**/*.proto")
    includeEmptyDirs = false
    manifest {
        attributes("Automatic-Module-Name" to "gondola.lyrics.model")
    }
}

spotless {
    lineEndings = LineEnding.UNIX
    kotlin {
        target("src/**/*.kt")
        ktlint(libs.versions.ktlint.get()).setEditorConfigPath(".editorconfig")
    }
    kotlinGradle {
        target("*.gradle.kts")
        ktlint(libs.versions.ktlint.get()).setEditorConfigPath(".editorconfig")
    }
    format("misc") {
        target(
            ".editorconfig",
            "*.properties",
            ".gitignore",
            "gradlew",
            "gradlew.bat",
            "gradle/*.toml",
            "gradle/wrapper/*.properties",
        )
        trimTrailingWhitespace()
        endWithNewline()
    }
}

mavenPublishing {
    configure(
        KotlinJvm(
            javadocJar = JavadocJar.Empty(),
            sourcesJar = SourcesJar.Sources(),
        ),
    )
    coordinates(group.toString(), "gondola-model", version.toString())
    if (providers.gradleProperty("centralRelease").map { it.toBoolean() }.getOrElse(false)) {
        publishToMavenCentral(automaticRelease = true, validateDeployment = DeploymentValidation.VALIDATED)
        signAllPublications()
    }
    pom {
        name.set("Gondola Lyric Model")
        description.set(project.description)
        url.set("https://github.com/gondola-lyrics/model")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/license/mit")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("folltoshe")
                name.set("folltoshe")
                url.set("https://github.com/folltoshe")
                email.set("folltoshe@foxmail.com")
                organization.set("gondola-lyrics")
                organizationUrl.set("https://github.com/gondola-lyrics")
            }
        }
        scm {
            url.set("https://github.com/gondola-lyrics/model")
            connection.set("scm:git:https://github.com/gondola-lyrics/model.git")
            developerConnection.set("scm:git:ssh://git@github.com/gondola-lyrics/model.git")
        }
    }
}

tasks.named<Jar>("emptyJavadocJar") {
    from(layout.projectDirectory.file("README.md"))
}

tasks.wrapper {
    gradleVersion = "9.6.0"
    distributionType = Wrapper.DistributionType.BIN
    distributionSha256Sum = "bbaeb2fef8710818cf0e261201dab964c572f92b942812df0c3620d62a529a01"
}
