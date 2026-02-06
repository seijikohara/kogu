fn main() {
    // Build Swift packages on macOS
    #[cfg(target_os = "macos")]
    {
        build_swift_helper();
        build_net_scanner_daemon();
    }

    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn build_swift_helper() {
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let swift_package_dir = manifest_dir.join("swift").join("KoguHelper");

    // Skip if Swift package doesn't exist (allows building without Swift setup)
    if !swift_package_dir.exists() {
        println!(
            "cargo:warning=Swift package not found at {:?}, skipping Swift build",
            swift_package_dir
        );
        return;
    }

    let target = env::var("TARGET").unwrap();
    let profile = env::var("PROFILE").unwrap();

    // Determine Swift build configuration
    let swift_config = match profile.as_str() {
        "release" => "release",
        _ => "debug",
    };

    // Determine architecture for Swift build
    let swift_arch = if target.contains("aarch64") {
        "arm64"
    } else if target.contains("x86_64") {
        "x86_64"
    } else {
        panic!("Unsupported target architecture: {}", target);
    };

    println!("cargo:rerun-if-changed=swift/KoguHelper/Sources/");
    println!("cargo:rerun-if-changed=swift/KoguHelper/Package.swift");

    // Build Swift package
    let status = Command::new("swift")
        .current_dir(&swift_package_dir)
        .args([
            "build",
            "-c",
            swift_config,
            "--arch",
            swift_arch,
            "--product",
            "KoguHelper",
        ])
        .status()
        .expect("Failed to execute swift build");

    if !status.success() {
        panic!("Swift build failed with status: {}", status);
    }

    // Find the built library
    let swift_build_dir = swift_package_dir
        .join(".build")
        .join(format!("{}-apple-macosx", swift_arch))
        .join(swift_config);

    // Link the Swift static library
    println!(
        "cargo:rustc-link-search=native={}",
        swift_build_dir.display()
    );
    println!("cargo:rustc-link-lib=static=KoguHelper");

    // Link required macOS frameworks
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=ServiceManagement");
    println!("cargo:rustc-link-lib=framework=AppKit");

    // Link Swift runtime (needed for static Swift libraries)
    // Find the Swift toolchain lib directory
    let swift_lib_output = Command::new("xcrun")
        .args(["--show-sdk-path"])
        .output()
        .expect("Failed to run xcrun");

    if swift_lib_output.status.success() {
        let sdk_path = String::from_utf8_lossy(&swift_lib_output.stdout)
            .trim()
            .to_string();

        // Swift runtime libraries are in the toolchain, not SDK
        let toolchain_output = Command::new("xcrun")
            .args(["--toolchain", "default", "--find", "swift"])
            .output()
            .expect("Failed to find Swift toolchain");

        if toolchain_output.status.success() {
            let swift_path = String::from_utf8_lossy(&toolchain_output.stdout)
                .trim()
                .to_string();
            // Go up from swift binary to lib/swift/macosx
            if let Some(toolchain_dir) =
                PathBuf::from(&swift_path).parent().and_then(|p| p.parent())
            {
                let swift_lib_dir = toolchain_dir.join("lib").join("swift").join("macosx");
                if swift_lib_dir.exists() {
                    println!("cargo:rustc-link-search=native={}", swift_lib_dir.display());
                }
            }
        }

        // Also check for usr/lib/swift in SDK
        let sdk_swift_lib = PathBuf::from(&sdk_path)
            .join("usr")
            .join("lib")
            .join("swift");
        if sdk_swift_lib.exists() {
            println!("cargo:rustc-link-search=native={}", sdk_swift_lib.display());
        }
    }
}

/// Build the NetScannerDaemon Swift executable
///
/// This daemon runs as a launchd service with root privileges for network scanning.
/// It's only used when the app is properly signed and notarized.
#[cfg(target_os = "macos")]
fn build_net_scanner_daemon() {
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let daemon_package_dir = manifest_dir.join("swift").join("NetScannerDaemon");

    // Skip if package doesn't exist
    if !daemon_package_dir.exists() {
        println!(
            "cargo:warning=NetScannerDaemon not found at {:?}, skipping",
            daemon_package_dir
        );
        return;
    }

    let target = env::var("TARGET").unwrap();
    let profile = env::var("PROFILE").unwrap();

    let swift_config = match profile.as_str() {
        "release" => "release",
        _ => "debug",
    };

    let swift_arch = if target.contains("aarch64") {
        "arm64"
    } else if target.contains("x86_64") {
        "x86_64"
    } else {
        println!(
            "cargo:warning=Unsupported architecture for NetScannerDaemon: {}",
            target
        );
        return;
    };

    println!("cargo:rerun-if-changed=swift/NetScannerDaemon/Sources/");
    println!("cargo:rerun-if-changed=swift/NetScannerDaemon/Package.swift");

    // Build the daemon
    let status = Command::new("swift")
        .current_dir(&daemon_package_dir)
        .args([
            "build",
            "-c",
            swift_config,
            "--arch",
            swift_arch,
            "--product",
            "NetScannerDaemon",
        ])
        .status()
        .expect("Failed to execute swift build for NetScannerDaemon");

    if !status.success() {
        // Don't fail the build - daemon is optional for development
        println!("cargo:warning=NetScannerDaemon build failed (optional for development)");
    }
}
