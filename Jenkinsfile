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
              sh 'docker system prune -af'
              sh 'docker compose up -d'
              sh 'docker compose ps --format json'
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