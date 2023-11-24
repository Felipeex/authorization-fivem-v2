pipeline {
    agent any

    stages {
        stage ("Build Image") {
          steps {
            script {
              dockerapp = docker.build("felipeex/fivem-shop-authorization-fivem-v2", '-f ./Dockerfile ./')
            }
          }
        }
    }
}