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
              sh 'docker compose up -d'
              sh 'docker compose ps --format json'
              sh 'docker image prune -f'
            }
          }
        }
    }

    post {
      always {
         sh "docker-compose down || true"
      }
   }
}