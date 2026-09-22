// =============================================================================
// STAGED SNIPPET — NOT WIRED INTO local-k8s/Jenkinsfile.k8s YET.
//
// To activate, make THREE changes to local-k8s/Jenkinsfile.k8s:
//
// ---------------------------------------------------------------------------
// (1) Add a `parameters` block to the top-level `pipeline { }`, e.g. right
//     after the existing `options { }` block (around line 40):
//
//     parameters {
//         booleanParam(
//             name: 'SONAR_ENABLED',
//             defaultValue: false,
//             description: 'Run the SonarQube analysis stage. Requires the ' +
//                          'sonar stack to be UP (local-k8s\\scripts\\start-sonar.ps1) ' +
//                          'and the kind cluster STOPPED (6 GB memory budget).'
//         )
//     }
//
// ---------------------------------------------------------------------------
// (2) Paste the stage below between `Frontend Quality Gate` and
//     `Build & Push Images` (i.e. after the closing brace around line 172).
//
// ---------------------------------------------------------------------------
// (3) One-time Jenkins UI setup:
//       Manage Jenkins -> Credentials -> System -> Add Credentials
//         Kind  : Secret text
//         ID    : sonar-token
//         Secret: the token generated at
//                 http://localhost:9000 -> My Account -> Security -> Generate Token
//
// =============================================================================
// DESIGN NOTES
// ------------
// * OPT-IN ONLY. With SONAR_ENABLED=false (the default) the pipeline behaves
//   exactly as it does today and can never fail because SonarQube is down.
// * Uses the identical `docker create` -> `docker cp` -> `docker start -a` ->
//   exit-code pattern as Stages 2 and 3, because on this setup the Jenkins
//   workspace lives in a Docker named volume that a sibling container cannot
//   bind-mount (the problem already documented in those stages).
// * `-Dsonar.qualitygate.wait=true` makes the scanner poll the server for the
//   gate verdict, so NO Jenkins SonarQube plugin and NO webhook are required.
//   (The plugin/webhook route is documented as an optional upgrade in
//   sonar/SONARQUBE.md.)
// * Assumes pde-sonar is attached to the `kind` Docker network (compose alias
//   `sonarqube`). start-sonar.ps1 attaches it automatically.
// * Selective `docker cp` (app/, tests/, coverage.xml only) rather than
//   `pde-backend/.` on purpose: it avoids copying pde-backend/.env into the
//   scanner container at all, and keeps the copy small.
// =============================================================================

        stage('SonarQube Analysis') {
            when { expression { params.SONAR_ENABLED } }
            steps {
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        set -eu

                        echo '--- SonarQube preconditions ---'
                        if ! docker inspect -f '{{.State.Running}}' pde-sonar 2>/dev/null | grep -q true; then
                            echo 'ERROR: container pde-sonar is not running.'
                            echo 'Start it with:  powershell -File local-k8s\\scripts\\start-sonar.ps1'
                            echo '(the kind cluster must be stopped first - see MEMORY-MANAGEMENT.md Mode E)'
                            exit 1
                        fi
                        test -f sonar-project.properties || {
                            echo 'ERROR: sonar-project.properties missing from the repo root.'
                            exit 1
                        }
                        if [ ! -f pde-backend/coverage.xml ]; then
                            echo 'WARNING: pde-backend/coverage.xml not found - backend coverage will report 0%.'
                            echo '         Add --cov-report=xml to the pytest call in the Backend Quality Gate stage.'
                        fi

scan_container=''
                        cleanup() {
                            if [ -n "$scan_container" ]; then
                                docker rm -f "$scan_container" >/dev/null 2>&1 || true
                            fi
                        }
                        trap cleanup EXIT
                        trap 'exit 1' HUP INT TERM

                        # 512 MiB scanner cap (swap disabled) - same convention as
                        # the backend/frontend quality-gate containers.
                        scan_container=$(docker create \
                            --memory=512m --memory-swap=512m --cpus=1 \
                            --label pde.memory-worker=true \
                            --network kind \
                            -e SONAR_HOST_URL="http://sonarqube:9000" \
                            -e SONAR_TOKEN="$SONAR_TOKEN" \
                            -w /usr/src \
                            sonarsource/sonar-scanner-cli:latest \
                            sonar-scanner -Dsonar.qualitygate.wait=true)

                        docker cp sonar-project.properties "$scan_container:/usr/src/sonar-project.properties"
                        docker cp pde-backend/app/.      "$scan_container:/usr/src/pde-backend/app"
                        if [ -d pde-backend/tests ]; then
                            docker cp pde-backend/tests/. "$scan_container:/usr/src/pde-backend/tests"
                        fi
                        if [ -f pde-backend/coverage.xml ]; then
                            docker cp pde-backend/coverage.xml "$scan_container:/usr/src/pde-backend/coverage.xml"
                        fi
                        docker cp pde-frontend/src/.     "$scan_container:/usr/src/pde-frontend/src"

                        # -a streams the analysis log; the trap removes the container.
                        docker start -a "$scan_container"
                        scan_exit=$(docker inspect --format '{{.State.ExitCode}}' "$scan_container")
                        exit "$scan_exit"
                    '''
                }
            }
        }

// =============================================================================
// OPTIONAL VARIANT — make the gate advisory (report but never fail the build).
// Replace the last two lines of the shell block above with:
//
//     docker start -a "$scan_container" || true
//     echo 'NOTE: quality gate result is advisory in this build.'
//
// Use this only while you are still calibrating the gate; a blocking gate is
// the whole point once your baseline is clean.
// =============================================================================