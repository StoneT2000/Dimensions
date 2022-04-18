curl --location --request POST 'localhost:9000/api/dimensions/oLBptg/tournaments/a0Zlpa/upload-by-key' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicGxheWVySUQiOiJxRU1reWgyQWlsdDQiLCJjcmVhdGlvbkRhdGUiOiIyMDIwLTA3LTA1VDIyOjI3OjAwLjU0NFoiLCJpYXQiOjE1OTkwOTgyMzgsImV4cCI6MTU5OTcwMzAzOH0.t6bpxqf-Wx47QoGGdiXJlkB8PoWIRNJNvTHGrPQ7olM' \
--header 'Content-Type: application/json' \
--data-raw '{
    "botname": "rock3",
    "botkey": "testfolder/rock.zip",
    "pathtofile": "rock.js",
    "playerID": "rock3"
}'

curl --location --request POST 'localhost:9000/api/dimensions/oLBptg/tournaments/a0Zlpa/upload-by-key' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicGxheWVySUQiOiJxRU1reWgyQWlsdDQiLCJjcmVhdGlvbkRhdGUiOiIyMDIwLTA3LTA1VDIyOjI3OjAwLjU0NFoiLCJpYXQiOjE1OTkwOTgyMzgsImV4cCI6MTU5OTcwMzAzOH0.t6bpxqf-Wx47QoGGdiXJlkB8PoWIRNJNvTHGrPQ7olM' \
--header 'Content-Type: application/json' \
--data-raw '{
    "botname": "rock2",
    "botkey": "testfolder/rock.zip",
    "pathtofile": "rock.js",
    "playerID": "rock2"
}'

curl --location --request POST 'localhost:9000/api/dimensions/oLBptg/tournaments/a0Zlpa/upload-by-key' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicGxheWVySUQiOiJxRU1reWgyQWlsdDQiLCJjcmVhdGlvbkRhdGUiOiIyMDIwLTA3LTA1VDIyOjI3OjAwLjU0NFoiLCJpYXQiOjE1OTkwOTgyMzgsImV4cCI6MTU5OTcwMzAzOH0.t6bpxqf-Wx47QoGGdiXJlkB8PoWIRNJNvTHGrPQ7olM' \
--header 'Content-Type: application/json' \
--data-raw '{
    "botname": "disabled",
    "botkey": "testfolder/disabled.zip",
    "pathtofile": "paper.java",
    "playerID": "rock1"
}'