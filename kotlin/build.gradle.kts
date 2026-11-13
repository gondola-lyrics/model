import com.diffplug.gradle.spotless.KotlinExtension
import com.diffplug.spotless.LineEnding
import com.vanniktech.maven.publish.DeploymentValidation
import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinJvm
import com.vanniktech.maven.publish.SourcesJar
import org.gradle.jvm.tasks.Jar
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

group = "io.github.gondola-lyrics"

version = "2.0.0"

description = "Gondola lyrics data model for Kotlin and Java"

plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
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
    testImplementation(libs.protobuf.java)
    testImplementation(kotlin("test-junit5"))
    testImplementation(platform(libs.junit.bom))
    testRuntimeOnly(libs.junit.jupiter.engine)
    testRuntimeOnly(libs.junit.platform.launcher)
}

kotlin.sourceSets.named("main") {
    kotlin.srcDir("src/generated/kotlin")
}

val testSchemaDirectory = layout.buildDirectory.dir("generated/test-schema")
val generateTestSchema = tasks.register<Exec>("generateTestSchema") {
    inputs.files(fileTree("../proto") { include("**/*.proto", "buf.yaml") }).withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.file(testSchemaDirectory.map { it.file("schema.gen.bin") })
    commandLine(
        "buf",
        "build",
        "../proto",
        "--as-file-descriptor-set",
        "--exclude-source-info",
        "-o",
        testSchemaDirectory.get().file("schema.gen.bin").asFile.absolutePath,
    )
    doFirst {
        testSchemaDirectory.get().asFile.mkdirs()
    }
}

sourceSets.test {
    resources.srcDir(files(testSchemaDirectory).builtBy(generateTestSchema))
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
    includeEmptyDirs = false
    manifest {
        attributes("Automatic-Module-Name" to "gondola.lyrics.model")
    }
}

spotless {
    lineEndings = LineEnding.UNIX
    kotlin {
        target("src/**/*.kt")
        targetExclude("src/generated/**")
        ktlint(libs.versions.ktlint.get()).setEditorConfigPath(".editorconfig")
    }
    format("kotlinGenerated", KotlinExtension::class.java) {
        target("src/generated/kotlin/**/*.gen.kt")
        // Generated filenames follow the proto layout rather than individual class names.
        ktlint(libs.versions.ktlint.get())
            .setEditorConfigPath(".editorconfig")
            .editorConfigOverride(mapOf("ktlint_standard_filename" to "disabled"))
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
