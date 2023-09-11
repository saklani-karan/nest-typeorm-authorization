# Role-Based Access Control (RBAC) Integration Module for TypeORM NestJS Repositories

## Overview

This module is designed to simplify the integration of Role-Based Access Control (RBAC) into your NestJS application using TypeORM. RBAC is a powerful mechanism for controlling access to various parts of your application based on the roles assigned to users. This module provides an easy and efficient way to manage RBAC in your NestJS project by leveraging the capabilities of TypeORM.

## Features

- Seamless integration of RBAC with TypeORM entities and repositories.
- Role and permission management with a user-friendly API.
- Fine-grained access control based on roles and permissions.
- Middleware for protecting routes and actions based on user roles.
- Extensible and customizable to fit your application's specific needs.

## Installation

To install this module, simply use npm or yarn:

```
npm install nest-rbac
```

## Usage

Import the module by simply adding it to the imports of your app.module file

```
// User is the user entity used in your core application logic
AuthorizationModule.forRootAsync<User>({
  ... configuration options here
})
```

Add the AuthorizationGuard in the App Guards or Filters to add the RBAC layer to the application logic

```
providers: [{
    provide: APP_GUARD,
    useClass: AuthorizationGuard
}]
```

Add the SetAccessPermissions decorator on controller methods to specify permissions required to access the method
```
SetAccessPermissions({
    resource: "users",
    action: "find"
})
```

You can also user dynamic values for SetAccessPermissions inferred from the path variables, headers or the body
```
// this will convert action into the value of the userId being called
SetAccessPermissions({
    resource: "users",
    action: "params:userId"
})
@Get("user/:userId")
```
