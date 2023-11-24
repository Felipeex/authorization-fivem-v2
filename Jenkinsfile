pipeline {
    agent any

    stages {
        stage ("Build Image") {
          steps {
            script {
              sh 'pm2 start processes.json'
            }
          }
        }
    }
}