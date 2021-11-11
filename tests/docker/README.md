# Docker Stuff


To build

```
docker build -t stonet2000/dimensions tests/docker
```

push
```
docker push stonet2000/dimensions
```

```
docker run -v $(pwd)/:/root -v /var/run/docker.sock:/var/run/docker.sock --rm -it stonet2000/dimensions bash
```
