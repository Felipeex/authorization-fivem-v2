pipeline {
    agent any

    stages {
        stage ("Build Image") {
          steps {
            script {
              def output = sh(returnStdout: true, script: 'pm2 start processes.json')
              echo "Output: ${output}"
            }
          }
        }
    }
}