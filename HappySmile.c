#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

int main(){

    // Make the computer memory explode!!
    int* happy;
    int iterations = 0;
    while(true){

        happy = (int*)malloc(__SIZEOF_INT128__ * 500000);
        printf("Happy explosion #%d\n", ++iterations);
        
    }

    return 0;
}