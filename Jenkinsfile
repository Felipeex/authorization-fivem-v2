pipeline {
    agent any

    stages {
        stage ("Build Image") {
          steps {
            script {
              sh 'docker compose build'
              sh 'docker compose push'
            }
          }
        }
        stage ("Deploy") {
          steps {
            script {
              sh 'docker compose up'
              sh 'docker compose ps --format json'
            }
          }
        }
    }
}