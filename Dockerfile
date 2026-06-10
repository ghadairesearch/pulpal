# Use the lightweight Nginx image
FROM nginx:alpine

# Copy all files from the current directory to the Nginx HTML folder
COPY . /usr/share/nginx/html

# Expose port 80 so Render can route traffic to it
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
