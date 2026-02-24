import garth
from garth.exc import GarthException
from garmin_planner.__init__ import logger

SESSION_DIR = '.garth'

class Client(object):
    def __init__(self, email, password):
        self._email = email
        self._password = password

        if not self.login():
            raise Exception("Login failed")
     
    def getAllWorkouts(self) -> dict:
        return garth.connectapi(f"""/workout-service/workouts""",
                                params={"start": 1, "limit": 999, "myWorkoutsOnly": True, "sharedWorkoutsOnly": False, "orderBy": "WORKOUT_NAME", "orderSeq": "ASC", "includeAtp": False})

    def getWorkout(self, workoutId: str) -> dict:
        return garth.connectapi(f"""/workout-service/workout/{workoutId}""",
                                method="GET")

    def deleteWorkout(self, workout: dict) -> bool:
        res = garth.connectapi(f"""/workout-service/workout/{workout['workoutId']}""",
                               method="DELETE")
        if res != None:
            logger.info(f"""Deleted workoutId: {workout['workoutId']} workoutName: {workout['workoutName']}""")
            return True
        else:
            logger.warn(f"""Could not delete workout. Workout not found with workoutId: {workout['workoutId']} (workoutName: {workout['workoutName']})""")
            return False

    def scheduleWorkout(self, id, dateJson: dict) -> bool:
        resJson = garth.connectapi(f"""/workout-service/schedule/{id}""",
                               method="POST",
                               headers={'Content-Type': 'application/json'},
                               json=dateJson)
        if ('workoutScheduleId' not in resJson):
            return False
        return True

    def importWorkout(self, workoutJson) -> dict:
        resJson = garth.connectapi(f"""/workout-service/workout""",
                               method="POST",
                               headers={'Content-Type': 'application/json'},
                               data=workoutJson)
        logger.info(f"""Imported workout {resJson['workoutName']}""")
        return resJson
    
    def login(self) -> bool:
        try:
            garth.resume(SESSION_DIR)
            garth.client.username
        except (FileNotFoundError, GarthException):
            garth.login(self._email, self._password)
            garth.save(SESSION_DIR)
        return True