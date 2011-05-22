PORT = 9914

try:
  try:
    import SimpleHTTPServer
    import SocketServer

    Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
    httpd = SocketServer.TCPServer(("localhost", PORT), Handler)
    httpd.serve_forever()

  except ImportError:
    from http.server import HTTPServer, SimpleHTTPRequestHandler
   
    httpd = HTTPServer(('localhost', 9914), SimpleHTTPRequestHandler)
    httpd.serve_forever()
except KeyboardInterrupt:
  pass
