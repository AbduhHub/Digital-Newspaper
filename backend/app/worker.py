# import redis
# from rq import SimpleWorker, Queue

# def start_worker():
#     redis_conn = redis.Redis()
#     worker = SimpleWorker(
#         [Queue(connection=redis_conn)],
#         connection=redis_conn
#     )
#     worker.work()


# if __name__ == "__main__":
#     start_worker()